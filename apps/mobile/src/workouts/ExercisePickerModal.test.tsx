import { Modal, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { fetchAllExercises } from '../exercises/exerciseQueries';
import { BACKGROUND_THEMES } from '../design/backgroundThemes';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { ExercisePickerModal } from './ExercisePickerModal';

jest.mock('../exercises/exerciseQueries', () => ({
  fetchAllExercises: jest.fn(),
  invalidateExerciseCache: jest.fn(),
  fetchExerciseSourceCounts: jest.fn().mockResolvedValue({ all: 2, builtin: 2, mine: 0 }),
}));

jest.mock('../design/BackgroundThemeContext', () => ({
  useBackgroundTheme: jest.fn(),
}));

jest.mock('../navigation/navigationTransitions', () => ({
  useReduceMotionPreference: jest.fn(),
}));

const mockFetchExercises = fetchAllExercises as jest.Mock;
const mockUseBackgroundTheme = useBackgroundTheme as jest.Mock;
const mockUseReduceMotionPreference = useReduceMotionPreference as jest.Mock;

beforeEach(() => {
  mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
  mockUseReduceMotionPreference.mockReturnValue(false);
  mockFetchExercises.mockReset().mockResolvedValue([
    {
      id: 'ex1',
      name: 'Barbell Bench Press',
      muscleGroup: 'chest',
      movementType: 'bilateral',
      isActive: true,
      createdBy: null,
    },
    {
      id: 'ex2',
      name: 'Barbell Back Squat',
      muscleGroup: 'quadriceps',
      movementType: 'bilateral',
      isActive: true,
      createdBy: null,
    },
  ]);
});

describe('ExercisePickerModal', () => {
  it('lists exercises with their muscle group', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    const item = await screen.findByTestId('exercise-item-ex1');
    expect(within(item).getByText('Barbell Bench Press')).toBeTruthy();
    expect(within(item).getByText('Chest · Bilateral')).toBeTruthy();
  });

  // Regression guard: the muscle-group filter row was sitting flush against
  // the search input above and the "Create Custom Exercise" card below (each
  // only contributes margin on one side), reading as vertically cramped even
  // though the chips themselves have comfortable internal spacing.
  it('gives the muscle-group filter row vertical breathing room above and below', () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    const wrap = screen.getByTestId('exercise-library-muscle-group-wrap');
    expect(StyleSheet.flatten(wrap.props.style).marginVertical).toBeGreaterThan(0);
  });

  it('marks an already-added exercise as added and disables it', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={['ex1']}
        onCreateCustom={jest.fn()}
      />,
    );

    expect(await screen.findByTestId('exercise-item-ex1')).toHaveTextContent(/\(added\)/);
  });

  it('calls onSelect when an exercise is pressed', async () => {
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex1'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ex1', name: 'Barbell Bench Press' }),
    );
  });

  it('re-queries when the search text changes', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByText('Barbell Bench Press');

    fireEvent.changeText(screen.getByTestId('exercise-search'), 'bench');

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'bench' }),
      ),
    );
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByText('Barbell Bench Press');

    fireEvent.press(screen.getByTestId('exercise-picker-close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state when no exercises match', async () => {
    mockFetchExercises.mockResolvedValue([]);

    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    expect(await screen.findByText('No exercises found')).toBeTruthy();
  });

  it('shows a Create Custom Exercise row at the top of the list and calls onCreateCustom when pressed', async () => {
    const onCreateCustom = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={onCreateCustom}
      />,
    );

    await screen.findByText('Barbell Bench Press');
    expect(screen.getByText('Create Custom Exercise')).toBeTruthy();
    expect(screen.getByText("Can't find the exercise? Create your own.")).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-picker-create-custom'));

    expect(onCreateCustom).toHaveBeenCalled();
  });

  it('follows the given accentColor for the selected muscle-group chip', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
        accentColor="#8B5CF6"
        onAccentColor="#0A0A0A"
      />,
    );
    await screen.findByText('Barbell Bench Press');

    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));
    const chip = screen.getByTestId('muscle-group-chip-chest');
    expect(StyleSheet.flatten(chip.props.style).backgroundColor).toBe('#8B5CF6');
  });

  it('follows the current Background Theme for its own background -- unlike a normal screen, this Modal has no AppBackgroundLayer behind it', async () => {
    mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.midnight });
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    await screen.findByText('Barbell Bench Press');
    const root = screen.getByTestId('exercise-picker-root');
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(
      BACKGROUND_THEMES.midnight.colors.background,
    );
  });

  it('respects Reduce Motion by disabling the modal slide animation', async () => {
    mockUseReduceMotionPreference.mockReturnValue(true);
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByText('Barbell Bench Press');

    expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
  });
});

describe('ExercisePickerModal -- one list of plain rows', () => {
  function renderPicker(alreadyAddedIds: string[] = []) {
    return render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={alreadyAddedIds}
        onCreateCustom={jest.fn()}
      />,
    );
  }

  it('names the close control for assistive tech', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.getByTestId('exercise-picker-close').props.accessibilityLabel).toBe('Close');
    expect(screen.getByText('Add Exercise')).toBeTruthy();
  });

  it('describes each row by name, muscle group and movement type, and says when it is already added', async () => {
    renderPicker(['ex2']);
    const open = await screen.findByTestId('exercise-item-ex1');
    const added = screen.getByTestId('exercise-item-ex2');

    expect(open.props.accessibilityLabel).toBe('Barbell Bench Press, Chest · Bilateral');
    expect(added).toHaveTextContent(/Barbell Back Squat \(added\)/);
    expect(open.props.accessibilityState.disabled).toBe(false);
  });

  it('shows a unilateral exercise is unilateral', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex3',
        name: 'Single-Arm Row',
        muscleGroup: 'back',
        movementType: 'unilateral',
        isActive: true,
        createdBy: null,
      },
    ]);
    renderPicker();

    expect(await screen.findByTestId('exercise-item-ex3')).toHaveTextContent(/Unilateral/);
  });

  it('labels the search field for assistive tech', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.getByTestId('exercise-search').props.accessibilityLabel).toBe('Search exercises');
  });

  it('shows an exercise photo, and tapping it opens the photo full size without selecting the exercise', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex3',
        name: 'Leg Press',
        muscleGroup: 'quadriceps',
        movementType: 'bilateral',
        isActive: true,
        createdBy: null,
        photoUrl: 'https://example.test/leg-press.jpg',
      },
    ]);
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex3-photo'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('exercise-picker-lightbox')).toBeTruthy();
  });

  it('filters to built-in or custom exercises from the source control', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByTestId('exercise-item-ex1');

    fireEvent.press(screen.getByText('Mine'));
    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'mine' }),
      ),
    );

    fireEvent.press(screen.getByTestId('exercise-source-builtin'));
    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'builtin' }),
      ),
    );
  });
});
