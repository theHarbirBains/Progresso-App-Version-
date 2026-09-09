import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { fetchExercises } from '../exercises/exerciseQueries';
import { ExercisePickerModal } from './ExercisePickerModal';

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
}));

const mockFetchExercises = fetchExercises as jest.Mock;

beforeEach(() => {
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
      />,
    );

    const item = await screen.findByTestId('exercise-picker-item-ex1');
    expect(within(item).getByText('Barbell Bench Press')).toBeTruthy();
    expect(within(item).getByText('Chest')).toBeTruthy();
  });

  it('marks an already-added exercise as added and disables it', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={['ex1']}
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
      />,
    );

    expect(await screen.findByText('No exercises found')).toBeTruthy();
  });
});
