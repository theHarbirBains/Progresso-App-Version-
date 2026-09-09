import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutHeader } from './WorkoutHeader';

describe('WorkoutHeader', () => {
  it('shows the title and calls onBack when the back button is pressed', () => {
    const onBack = jest.fn();
    render(<WorkoutHeader title="Start Workout" onBack={onBack} />);

    expect(screen.getByText('Start Workout')).toBeTruthy();
    fireEvent.press(screen.getByTestId('workout-header-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render an options button when onOpenOptions is omitted', () => {
    render(<WorkoutHeader title="Start Workout" onBack={jest.fn()} />);

    expect(screen.queryByTestId('workout-header-options')).toBeNull();
  });

  it('calls onOpenOptions when the options button is pressed', () => {
    const onOpenOptions = jest.fn();
    render(<WorkoutHeader title="Push Day" onBack={jest.fn()} onOpenOptions={onOpenOptions} />);

    fireEvent.press(screen.getByTestId('workout-header-options'));

    expect(onOpenOptions).toHaveBeenCalled();
  });
});
