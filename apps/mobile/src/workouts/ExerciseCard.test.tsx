import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExerciseCard } from './ExerciseCard';

const baseProps = {
  exerciseName: 'Barbell Bench Press',
  muscleGroup: 'chest' as const,
  sets: [{ id: 's1', setIndex: 1, weight: '', reps: '', completed: false, canComplete: false }],
  onChangeWeight: jest.fn(),
  onChangeReps: jest.fn(),
  onToggleComplete: jest.fn(),
  onAddSet: jest.fn(),
  onRemoveExercise: jest.fn(),
  accentColor: '#2F80FF',
  onAccentColor: '#06201C',
  testID: 'exercise-card',
};

describe('ExerciseCard', () => {
  it('shows the exercise name and the muscle group from real exercise data (not hardcoded)', () => {
    render(<ExerciseCard {...baseProps} muscleGroup="shoulders" />);

    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.getByText('Shoulders')).toBeTruthy();
  });

  it('renders no exercise image', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByRole('image')).toBeNull();
  });

  it('renders exactly one set row for a newly added exercise', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.getByTestId('exercise-card-set-s1')).toBeTruthy();
  });

  it('calls onAddSet when Add Set is pressed', () => {
    const onAddSet = jest.fn();
    render(<ExerciseCard {...baseProps} onAddSet={onAddSet} />);

    fireEvent.press(screen.getByTestId('exercise-card-add-set'));

    expect(onAddSet).toHaveBeenCalled();
  });

  it('calls onRemoveExercise when the remove control is pressed', () => {
    const onRemoveExercise = jest.fn();
    render(<ExerciseCard {...baseProps} onRemoveExercise={onRemoveExercise} />);

    fireEvent.press(screen.getByTestId('exercise-card-remove'));

    expect(onRemoveExercise).toHaveBeenCalled();
  });

  it('does not render reorder controls when onMoveUp/onMoveDown are omitted', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByTestId('exercise-card-move-up')).toBeNull();
    expect(screen.queryByTestId('exercise-card-move-down')).toBeNull();
  });

  it('calls onMoveUp/onMoveDown when reorder controls are pressed', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    render(<ExerciseCard {...baseProps} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />);

    fireEvent.press(screen.getByTestId('exercise-card-move-up'));
    fireEvent.press(screen.getByTestId('exercise-card-move-down'));

    expect(onMoveUp).toHaveBeenCalled();
    expect(onMoveDown).toHaveBeenCalled();
  });

  it('does not render RIR, RPE, or estimated calories anywhere', () => {
    render(<ExerciseCard {...baseProps} />);

    expect(screen.queryByText(/RIR/i)).toBeNull();
    expect(screen.queryByText(/RPE/i)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
  });

  it('renders multiple sets in order when there are several', () => {
    render(
      <ExerciseCard
        {...baseProps}
        sets={[
          { id: 's1', setIndex: 1, weight: '100', reps: '8', completed: true, canComplete: true },
          { id: 's2', setIndex: 2, weight: '', reps: '', completed: false, canComplete: false },
        ]}
      />,
    );

    expect(screen.getByTestId('exercise-card-set-s1')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-set-s2')).toBeTruthy();
  });
});
