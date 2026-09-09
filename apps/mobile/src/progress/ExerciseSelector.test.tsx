import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExerciseSelector } from './ExerciseSelector';

const exercises = [
  { id: 'ex-1', name: 'Bench Press' },
  { id: 'ex-2', name: 'Squat' },
];

describe('ExerciseSelector', () => {
  it('shows the currently selected exercise name on the trigger', () => {
    render(
      <ExerciseSelector
        exercises={exercises}
        selectedId="ex-1"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(screen.getByText('Bench Press')).toBeTruthy();
  });

  it('opens the exercise list modal when the trigger is pressed', () => {
    render(
      <ExerciseSelector
        exercises={exercises}
        selectedId="ex-1"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(screen.queryByTestId('exercise-option-ex-2')).toBeNull();

    fireEvent.press(screen.getByTestId('exercise-selector-trigger'));

    expect(screen.getByTestId('exercise-option-ex-2')).toBeTruthy();
  });

  it('calls onSelect and closes when an exercise is chosen', () => {
    const onSelect = jest.fn();
    render(
      <ExerciseSelector
        exercises={exercises}
        selectedId="ex-1"
        onSelect={onSelect}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-selector-trigger'));
    fireEvent.press(screen.getByTestId('exercise-option-ex-2'));

    expect(onSelect).toHaveBeenCalledWith('ex-2');
    expect(screen.queryByTestId('exercise-option-ex-2')).toBeNull();
  });

  it('lists only the exercises passed in (already filtered by the caller to those with history)', () => {
    render(
      <ExerciseSelector
        exercises={exercises}
        selectedId="ex-1"
        onSelect={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('exercise-selector-trigger'));

    expect(screen.getByTestId('exercise-option-ex-1')).toBeTruthy();
    expect(screen.getByTestId('exercise-option-ex-2')).toBeTruthy();
    expect(screen.queryByTestId('exercise-option-ex-3')).toBeNull();
  });
});
