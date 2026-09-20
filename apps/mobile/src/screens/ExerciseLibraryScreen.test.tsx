import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchExerciseSourceCounts, fetchExercises } from '../exercises/exerciseQueries';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { colors } from '../design/theme';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
  fetchExerciseSourceCounts: jest.fn(),
}));

// Isolates this screen's own list/filter/pagination logic from the form's
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
const mockFetchExercises = fetchExercises as jest.Mock;
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
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'workout' }}>
      <ExerciseLibraryScreen navigation={navigation} route={{} as never} />
    </AppMenuContext.Provider>,
  );
}

const builtinRow = {
  id: 'ex-builtin',
  name: 'Barbell Bench Press',
  muscleGroup: 'chest',
  movementType: 'bilateral',
  loggingStyle: null,
  isActive: true,
  createdBy: null,
};
const mineRow = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscleGroup: 'biceps',
  movementType: 'bilateral',
  loggingStyle: null,
  isActive: true,
  createdBy: 'user-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchExercises.mockReset();
  mockFetchExercises.mockResolvedValue({
    rows: [builtinRow, mineRow],
    hasMore: false,
    totalCount: 2,
  });
  mockFetchExerciseSourceCounts.mockReset();
  mockFetchExerciseSourceCounts.mockResolvedValue({ all: 328, builtin: 245, mine: 12 });
  mockGoBack.mockClear();
  mockOpenMenu.mockClear();
});

// FlatList/VirtualizedList schedules a deferred internal setState (cell
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
  it('loads and displays exercises on mount', async () => {
    renderScreen();

    expect(await screen.findByTestId('exercise-item-ex-builtin')).toHaveTextContent(
      /Barbell Bench Press/,
    );
    expect(screen.getByTestId('exercise-item-ex-mine')).toHaveTextContent(/My Curl Variation/);
    expect(mockFetchExercises).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        search: '',
        muscleGroup: null,
        source: 'all',
        ascending: true,
        page: 0,
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

  it('opens the app-level side menu (workout mode) when the header button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-library-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith('workout');
    await settle();
  });

  it('debounces search input before querying', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchExercises.mockClear();

    fireEvent.changeText(screen.getByTestId('exercise-search'), 'bench');

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(expect.objectContaining({ search: 'bench' })),
    );
    await settle();
  });

  it('filters by muscle group when a chip is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchExercises.mockClear();

    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(
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
  });

  it('filters by source when a category card is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchExercises.mockClear();

    fireEvent.press(screen.getByTestId('exercise-source-mine'));

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(expect.objectContaining({ source: 'mine' })),
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

  it('shows the real total count of the current filtered view, not just the loaded page', async () => {
    mockFetchExercises.mockResolvedValue({
      rows: [builtinRow],
      hasMore: true,
      totalCount: 328,
    });

    renderScreen();

    expect(await screen.findByTestId('exercise-library-count')).toHaveTextContent(/328/);
    await settle();
  });

  it('toggles sort order and refetches when the sort control is pressed', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchExercises.mockClear();

    fireEvent.press(screen.getByTestId('exercise-library-sort'));

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(
        expect.objectContaining({ ascending: false }),
      ),
    );
    expect(screen.getByTestId('exercise-library-sort')).toHaveTextContent(/Z → A/);
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

  it('returns to the list and refetches when the form reports done', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    fireEvent.press(screen.getByTestId('exercise-create-button'));
    await screen.findByTestId('mock-exercise-form-mode');
    mockFetchExercises.mockClear();

    fireEvent.press(screen.getByTestId('mock-exercise-form-done'));

    expect(await screen.findByTestId('exercise-item-ex-builtin')).toBeTruthy();
    expect(mockFetchExercises).toHaveBeenCalledWith(expect.objectContaining({ page: 0 }));
    await settle();
  });

  it('shows a Load More button when there are more pages, and appends results on press', async () => {
    mockFetchExercises
      .mockResolvedValueOnce({ rows: [builtinRow], hasMore: true, totalCount: 2 })
      .mockResolvedValueOnce({ rows: [mineRow], hasMore: false, totalCount: 2 });

    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');
    expect(screen.getByTestId('exercise-load-more')).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-load-more'));

    expect(await screen.findByTestId('exercise-item-ex-mine')).toBeTruthy();
    expect(mockFetchExercises).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(screen.queryByTestId('exercise-load-more')).toBeNull();
    await settle();
  });

  it('shows an error message when the query fails', async () => {
    mockFetchExercises.mockReset().mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('exercise-library-error')).toHaveTextContent('network error');
    await settle();
  });

  it('shows an empty state when no exercises match the current filters', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [], hasMore: false, totalCount: 0 });

    renderScreen();

    expect(await screen.findByTestId('exercise-library-empty')).toBeTruthy();
    await settle();
  });
});

describe('ExerciseLibraryScreen -- plain rows, tabs for the source, New Exercise in the header', () => {
  it('draws no cards', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
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

  it('separates rows with a hairline, none above the first', async () => {
    renderScreen();
    const first = StyleSheet.flatten(
      (await screen.findByTestId('exercise-item-ex-builtin')).props.style,
    );
    const second = StyleSheet.flatten(screen.getByTestId('exercise-item-ex-mine').props.style);

    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
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

  it('shows All / Built-in / Mine as tabs with their real totals, the selected one in the accent', async () => {
    renderScreen();
    const all = await screen.findByTestId('exercise-source-all');

    expect(all.props.accessibilityLabel).toBe('All, 328 exercises');
    expect(all.props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(all.props.style).borderBottomColor).toBe(
      DEFAULT_WORKOUT_THEME.accent,
    );
    const mine = screen.getByTestId('exercise-source-mine');
    expect(mine.props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(mine.props.style).borderBottomColor).toBe('transparent');
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

  it('gives each source tab and the sort control a comfortable touch target', async () => {
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expect(
      StyleSheet.flatten(screen.getByTestId('exercise-source-all').props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
    expect(
      StyleSheet.flatten(screen.getByTestId('exercise-library-sort').props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('exercise-library-sort').props.accessibilityLabel).toBe(
      'Toggle sort order',
    );
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchExercises.mockResolvedValue({
      rows: [builtinRow, mineRow],
      hasMore: true,
      totalCount: 40,
    });
    renderScreen();
    await screen.findByTestId('exercise-item-ex-builtin');

    expectNoBareText();
    await settle();
  });
});
