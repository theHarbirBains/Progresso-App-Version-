import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchAllExercises, fetchExerciseSourceCounts } from '../exercises/exerciseQueries';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { colors } from '../design/theme';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchAllExercises: jest.fn(),
  invalidateExerciseCache: jest.fn(),
  fetchExerciseSourceCounts: jest.fn(),
}));

// Isolates this screen's own list/filter logic from the form's
// implementation. babel-plugin-jest-hoist forbids referencing outer-scope
// variables inside jest.mock() factories, so react-native/react are
// require()'d inside it instead of relying on the file's top-level import.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
jest.mock('./ExerciseFormScreen', () => {
  const react = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    ExerciseFormScreen: (props: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(Text, { testID: 'mock-exercise-form-mode' }, props.mode),
        props.mode === 'edit'
          ? react.createElement(Text, { testID: 'mock-exercise-form-name' }, props.exercise.name)
          : null,
        react.createElement(
          TouchableOpacity,
          { testID: 'mock-exercise-form-done', onPress: props.onDone },
          react.createElement(Text, null, 'done'),
        ),
        react.createElement(
          TouchableOpacity,
          { testID: 'mock-exercise-form-cancel', onPress: props.onCancel },
          react.createElement(Text, null, 'cancel'),
        ),
      ),
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const mockUseAuth = useAuth as jest.Mock;
const mockFetchAllExercises = fetchAllExercises as jest.Mock;
const mockFetchExerciseSourceCounts = fetchExerciseSourceCounts as jest.Mock;
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation = { goBack: mockGoBack } as any;

const mockOpenMenu = jest.fn();

// ExerciseLibraryScreen now opens the app-level side menu (via
// AppMenuContext) from its own header, same as Dashboard -- this stands in
// for that root-level provider.
function renderScreen() {
  return render(
    <ProfileProvider>
      <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'workout' }}>
        <ExerciseLibraryScreen navigation={navigation} route={{} as never} />
      </AppMenuContext.Provider>
    </ProfileProvider>,
  );
}

// Deliberately different starting letters (B, M) so most tests exercise two
// distinct A-Z sections; a same-letter pair is used separately below for the
// within-section hairline-divider test.
const builtinRow = {
  id: 'ex-builtin',
  name: 'Barbell Bench Press',
  muscleGroup: 'chest',
  movementType: 'bilateral',
  loggingStyle: null,
  photoUrl: null,
  isActive: true,
  createdBy: null,
};
const mineRow = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscleGroup: 'biceps',
  movementType: 'bilateral',
  loggingStyle: null,
  photoUrl: null,
  isActive: true,
  createdBy: 'user-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchAllExercises.mockReset().mockResolvedValue([builtinRow, mineRow]);
  mockFetchExerciseSourceCounts.mockReset();
  mockFetchExerciseSourceCounts.mockResolvedValue({ all: 328, builtin: 245, mine: 12 });
  mockGoBack.mockClear();
  mockOpenMenu.mockClear();
});

// SectionList/VirtualizedList schedules a deferred internal setState (cell
// render bookkeeping) via a real setTimeout that can otherwise fire after a
// test ends. RNTL's automatic unmount runs in its own afterEach registered
// before any declared in this file, so flushing from an afterEach here
// would run too late, against an already-unmounted tree. Calling this at
// the end of each test instead, while the component is still mounted, lets
// the pending timer settle inside act() before RNTL's cleanup unmounts it.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe('ExerciseLibraryScreen', () => {
  it('loads and displays every matching exercise, grouped alphabetically', async () => {
    renderScreen();

    expect(await screen.findByTestId('exercise-item-ex-builtin')).toHaveTextContent(
      /Barbell Bench Press/,
    );
    expect(screen.getByTestId('exercise-item-ex-mine')).toHaveTextContent(/My Curl Variation/);
    expect(screen.getByTestId('exercise-library-section-B')).toHaveTextContent('B');
    expect(screen.getByTestId('exercise-library-section-M')).toHaveTextContent('M');
    expect(mockFetchAllExercises).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        search: '',
        muscleGroup: null,
        source: 'all',
      }),
    );
    await settle();
  });

  it('shows the centered "Exercise Library" title and hamburger on the shared AppHeader row', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(screen.getByTestId('exercise-library-header')).toBeTruthy();
    expect(screen.getByTestId('exercise-library-open-menu')).toBeTruthy();
    expect(screen.getByText('Exercise Library')).toBeTruthy();
    await settle();
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-library-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
    await settle();
  });

  it('debounces search input before querying', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchAllExercises.mockClear();

    fireEvent.changeText(screen.getByTestId('exercise-search'), 'bench');

    await waitFor(() =>
      expect(mockFetchAllExercises).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'bench' }),
      ),
    );
    await settle();
  });

  it('filters by muscle group when a chip is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchAllExercises.mockClear();

    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));

    await waitFor(() =>
      expect(mockFetchAllExercises).toHaveBeenCalledWith(
        expect.objectContaining({ muscleGroup: 'chest' }),
      ),
    );
    await settle();
  });

  // Regression guard: the muscle-group filter row was sitting flush against
  // the search input above and the source-filter row below (each only
  // contributes margin on one side), reading as vertically cramped.
  it('gives the muscle-group filter row vertical breathing room above and below', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    const wrap = screen.getByTestId('exercise-library-muscle-group-wrap');
    expect(StyleSheet.flatten(wrap.props.style).marginVertical).toBeGreaterThan(0);
    await settle();
  });

  it('filters by source when a category card is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchAllExercises.mockClear();

    fireEvent.press(screen.getByTestId('exercise-source-mine'));

    await waitFor(() =>
      expect(mockFetchAllExercises).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'mine' }),
      ),
    );
    await settle();
  });

  it('shows the real, independent total for each source category, never a fabricated count', async () => {
    renderScreen();

    expect(await screen.findByTestId('exercise-source-all-count')).toHaveTextContent(/328/);
    expect(screen.getByTestId('exercise-source-builtin-count')).toHaveTextContent(/245/);
    expect(screen.getByTestId('exercise-source-mine-count')).toHaveTextContent(/12/);
    await settle();
  });

  it('shows the real count of the current filtered view', async () => {
    mockFetchAllExercises.mockResolvedValue([builtinRow]);

    renderScreen();

    expect(await screen.findByTestId('exercise-library-count')).toHaveTextContent('1 exercise');
    await settle();
  });

  it('opens the create form when "New Exercise" is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-create-button'));

    expect(await screen.findByTestId('mock-exercise-form-mode')).toHaveTextContent('create');
    await settle();
  });

  it("opens the edit form for the user's own exercise", async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-item-ex-mine'));

    expect(await screen.findByTestId('mock-exercise-form-mode')).toHaveTextContent('edit');
    expect(screen.getByTestId('mock-exercise-form-name')).toHaveTextContent('My Curl Variation');
    await settle();
  });

  it('does not open a form when a built-in exercise is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-item-ex-builtin'));

    expect(screen.queryByTestId('mock-exercise-form-mode')).toBeNull();
    await settle();
  });

  it('shows Built-in/Mine badges reflecting real ownership, never fabricated classifications', async () => {
    renderScreen();

    expect(await screen.findByTestId('exercise-item-ex-builtin')).toHaveTextContent(/Built-in/);
    expect(screen.getByTestId('exercise-item-ex-mine')).toHaveTextContent(/Mine/);
    await settle();
  });

  it('shows real muscle-group and movement-type tags on each row, not images', async () => {
    renderScreen();

    const row = await screen.findByTestId('exercise-item-ex-builtin');
    expect(row).toHaveTextContent(/Chest/);
    expect(row).toHaveTextContent(/Bilateral/);
    await settle();
  });

  it("shows a photo thumbnail, initial-letter fallback for one that doesn't have one -- like a contact photo", async () => {
    mockFetchAllExercises.mockResolvedValue([
      { ...builtinRow, photoUrl: 'https://example.com/machine.jpg' },
      mineRow,
    ]);
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(screen.getByTestId('exercise-item-ex-builtin-photo-inner').props.source).toEqual({
      uri: 'https://example.com/machine.jpg',
    });
    // mineRow has no photo -- falls back to its own initial letter, not a blank tile.
    expect(screen.getByTestId('exercise-item-ex-mine-photo-inner')).toHaveTextContent('M');
    await settle();
  });

  it('returns to the list and refetches when the form reports done', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    fireEvent.press(screen.getByTestId('exercise-create-button'));
    await screen.findByTestId('mock-exercise-form-mode');
    mockFetchAllExercises.mockClear();

    fireEvent.press(screen.getByTestId('mock-exercise-form-done'));

    expect(await screen.findByTestId('exercise-item-ex-builtin')).toBeTruthy();
    expect(mockFetchAllExercises).toHaveBeenCalled();
    await settle();
  });

  it('shows an error message with a working retry when the query fails', async () => {
    mockFetchAllExercises.mockReset().mockRejectedValueOnce(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('exercise-library-error')).toHaveTextContent('network error');

    mockFetchAllExercises.mockResolvedValue([builtinRow, mineRow]);
    fireEvent.press(screen.getByTestId('exercise-library-error-retry'));

    expect(await screen.findByTestId('exercise-item-ex-builtin')).toBeTruthy();
    await settle();
  });

  it('shows an empty state when no exercises match the current filters', async () => {
    mockFetchAllExercises.mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByTestId('exercise-library-empty')).toBeTruthy();
    await settle();
  });
});

describe('ExerciseLibraryScreen -- two widgets, source blocks, New Exercise in the header', () => {
  it('is two widgets: browse (search, filters, sources) and the exercise list', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(2);
    const browse = within(screen.getByTestId('exercise-library-browse'));
    expect(browse.getByTestId('exercise-search')).toBeTruthy();
    expect(browse.getByTestId('exercise-source-all')).toBeTruthy();
    const list = within(screen.getByTestId('exercise-library-list'));
    expect(list.getByTestId('exercise-library-count')).toBeTruthy();
    expect(list.getByTestId('exercise-item-ex-builtin')).toBeTruthy();
    await settle();
  });

  it('puts a named New Exercise "+" in the header, next to the menu', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(screen.getByTestId('exercise-create-button').props.accessibilityLabel).toBe(
      'New Exercise',
    );
    expect(screen.getByTestId('exercise-library-open-menu').props.accessibilityLabel).toBe(
      'Open menu',
    );
    await settle();
  });

  it('shows the muscle group and movement type as one muted line, not tag chips', async () => {
    renderScreen();
    const row = await screen.findByTestId('exercise-item-ex-builtin');

    expect(row).toHaveTextContent(/Chest · Bilateral/);
    await settle();
  });

  it("marks the user's own exercises in the mode accent and built-ins in muted text, as plain words", async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    const mine = StyleSheet.flatten(
      within(screen.getByTestId('exercise-item-ex-mine')).getByText('Mine').props.style,
    );
    expect(mine.color).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(mine.backgroundColor).toBeUndefined();
    expect(mine.borderWidth).toBeUndefined();
    const builtin = StyleSheet.flatten(
      within(screen.getByTestId('exercise-item-ex-builtin')).getByText('Built-in').props.style,
    );
    expect(builtin.color).toBe(colors.textMuted);
    await settle();
  });

  it('only shows a chevron on rows that open (the built-in is read-only)', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    const chevrons = screen
      .UNSAFE_queryAllByType(Feather)
      .filter((icon) => icon.props.name === 'chevron-right');
    expect(chevrons).toHaveLength(1);
    await settle();
  });

  it('shows All / Built-in / Mine as blocks with their real totals, the selected one in the accent', async () => {
    renderScreen();
    const all = await screen.findByTestId('exercise-source-all');

    expect(all.props.accessibilityLabel).toBe('All, 328 exercises');
    expect(all.props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(all.props.style).borderColor).toBe(DEFAULT_WORKOUT_THEME.accent);
    const mine = screen.getByTestId('exercise-source-mine');
    expect(mine.props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(mine.props.style).borderColor).toBe('transparent');
    await settle();
  });

  it('moves the selected tab when another source is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-source-mine'));

    expect(screen.getByTestId('exercise-source-mine').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('exercise-source-all').props.accessibilityState.selected).toBe(false);
    await settle();
  });

  it('gives each source tab a comfortable touch target', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(
      StyleSheet.flatten(screen.getByTestId('exercise-source-all').props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expectNoBareText();
    await settle();
  });
});
