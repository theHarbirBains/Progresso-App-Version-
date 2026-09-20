import { Modal, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { fetchExercises } from '../exercises/exerciseQueries';
import { BACKGROUND_THEMES } from '../design/backgroundThemes';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { AppCard } from '../design/AppCard';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { ExercisePickerModal } from './ExercisePickerModal';

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
}));

jest.mock('../design/BackgroundThemeContext', () => ({
  useBackgroundTheme: jest.fn(),
}));

jest.mock('../navigation/navigationTransitions', () => ({
  useReduceMotionPreference: jest.fn(),
}));

const mockFetchExercises = fetchExercises as jest.Mock;
const mockUseBackgroundTheme = useBackgroundTheme as jest.Mock;
const mockUseReduceMotionPreference = useReduceMotionPreference as jest.Mock;

beforeEach(() => {
  mockUseBackgroundTheme.mockReturnValue({ theme: BACKGROUND_THEMES.obsidian });
  mockUseReduceMotionPreference.mockReturnValue(false);
  mockFetchExercises.mockReset().mockResolvedValue({
    rows: [
      {
        id: 'ex1',
        name: 'Barbell Bench Press',
        muscleGroup: 'chest',
        isActive: true,
        createdBy: null,
      },
      {
        id: 'ex2',
        name: 'Barbell Back Squat',
        muscleGroup: 'quadriceps',
        isActive: true,
        createdBy: null,
      },
    ],
    hasMore: false,
  });
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

    const item = await screen.findByTestId('exercise-picker-item-ex1');
    expect(within(item).getByText('Barbell Bench Press')).toBeTruthy();
    expect(within(item).getByText('Chest')).toBeTruthy();
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

    const wrap = screen.getByTestId('exercise-picker-muscle-group-wrap');
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

    const item = await screen.findByTestId('exercise-picker-item-ex1');
    expect(item).toHaveTextContent(/added/);
    expect(item.props.accessibilityState?.disabled).toBe(true);
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

    fireEvent.press(await screen.findByTestId('exercise-picker-item-ex1'));

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

    fireEvent.changeText(screen.getByTestId('exercise-picker-search'), 'bench');

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
    mockFetchExercises.mockResolvedValue({ rows: [], hasMore: false });

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

  it('draws no cards -- Create Custom Exercise and every exercise are rows', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    expect(screen.getByTestId('exercise-picker-create-custom').props.accessibilityRole).toBe(
      'button',
    );
  });

  it('names the close control for assistive tech', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.getByTestId('exercise-picker-close').props.accessibilityLabel).toBe('Close');
    expect(screen.getByText('Add Exercise')).toBeTruthy();
  });

  it('separates exercise rows with a hairline', async () => {
    renderPicker();
    const row = await screen.findByTestId('exercise-picker-item-ex1');

    expect(StyleSheet.flatten(row.props.style).borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('describes each row by name and muscle group, and says when it is already added', async () => {
    renderPicker(['ex2']);
    const open = await screen.findByTestId('exercise-picker-item-ex1');
    const added = screen.getByTestId('exercise-picker-item-ex2');

    expect(open.props.accessibilityLabel).toBe('Barbell Bench Press, Chest');
    expect(added.props.accessibilityLabel).toBe('Barbell Back Squat, Quadriceps, already added');
    expect(added.props.accessibilityState.disabled).toBe(true);
    expect(open.props.accessibilityState.disabled).toBe(false);
  });

  it('labels the search field for assistive tech', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.getByTestId('exercise-picker-search').props.accessibilityLabel).toBe(
      'Search exercises',
    );
  });
});
