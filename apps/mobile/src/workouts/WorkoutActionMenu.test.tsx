import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutActionMenu } from './WorkoutActionMenu';

describe('WorkoutActionMenu', () => {
  it('shows Complete Workout as the only action', () => {
    render(<WorkoutActionMenu visible={true} onClose={jest.fn()} onCompleteWorkout={jest.fn()} />);

    expect(screen.getByTestId('workout-action-complete')).toBeTruthy();
  });

  it('calls onCompleteWorkout when pressed', () => {
    const onCompleteWorkout = jest.fn();
    render(
      <WorkoutActionMenu
        visible={true}
        onClose={jest.fn()}
        onCompleteWorkout={onCompleteWorkout}
      />,
    );

    fireEvent.press(screen.getByTestId('workout-action-complete'));

    expect(onCompleteWorkout).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn();
    render(<WorkoutActionMenu visible={true} onClose={onClose} onCompleteWorkout={jest.fn()} />);

    fireEvent.press(screen.getByTestId('workout-action-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });
});
