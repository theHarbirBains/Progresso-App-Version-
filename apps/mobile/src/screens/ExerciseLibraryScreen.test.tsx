import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchExercises } from '../exercises/exerciseQueries';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
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
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation = { goBack: mockGoBack } as any;

const builtinRow = {
  id: 'ex-builtin',
  name: 'Barbell Bench Press',
  muscleGroup: 'chest',
  isActive: true,
  createdBy: null,
};
const mineRow = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscleGroup: 'biceps',
  isActive: true,
  createdBy: 'user-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchExercises.mockReset();
  mockFetchExercises.mockResolvedValue({ rows: [builtinRow, mineRow], hasMore: false });
  mockGoBack.mockClear();
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
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);

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
        page: 0,
      }),
    );
    await settle();
  });

  it('calls navigation.goBack() when Back is pressed', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-library-back'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });

  it('debounces search input before querying', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchExercises.mockClear();

    fireEvent.changeText(screen.getByTestId('exercise-search'), 'bench');

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(expect.objectContaining({ search: 'bench' })),
    );
    await settle();
  });

  it('filters by muscle group when a chip is pressed', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
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

  it('filters by source when a tab is pressed', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('exercise-item-ex-builtin');
    mockFetchExercises.mockClear();

    fireEvent.press(screen.getByTestId('exercise-source-mine'));

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(expect.objectContaining({ source: 'mine' })),
    );
    await settle();
  });

  it('opens the create form when "New Exercise" is pressed', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-create-button'));

    expect(await screen.findByTestId('mock-exercise-form-mode')).toHaveTextContent('create');
    await settle();
  });

  it("opens the edit form for the user's own exercise", async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-item-ex-mine'));

    expect(await screen.findByTestId('mock-exercise-form-mode')).toHaveTextContent('edit');
    expect(screen.getByTestId('mock-exercise-form-name')).toHaveTextContent('My Curl Variation');
    await settle();
  });

  it('does not open a form when a built-in exercise is pressed', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('exercise-item-ex-builtin');

    fireEvent.press(screen.getByTestId('exercise-item-ex-builtin'));

    expect(screen.queryByTestId('mock-exercise-form-mode')).toBeNull();
    await settle();
  });

  it('returns to the list and refetches when the form reports done', async () => {
    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
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
      .mockResolvedValueOnce({ rows: [builtinRow], hasMore: true })
      .mockResolvedValueOnce({ rows: [mineRow], hasMore: false });

    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);
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

    render(<ExerciseLibraryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('exercise-library-error')).toHaveTextContent('network error');
    await settle();
  });
});
