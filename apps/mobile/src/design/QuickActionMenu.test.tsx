import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuickActionMenu } from './QuickActionMenu';

describe('QuickActionMenu', () => {
  it('shows only real, already-existing actions', () => {
    render(
      <QuickActionMenu
        visible={true}
        onClose={jest.fn()}
        onStartWorkout={jest.fn()}
        onLogFood={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    expect(screen.getByTestId('quick-action-start-workout')).toBeTruthy();
    expect(screen.getByTestId('quick-action-log-food')).toBeTruthy();
  });

  it('calls onStartWorkout when Start Workout is pressed', () => {
    const onStartWorkout = jest.fn();
    render(
      <QuickActionMenu
        visible={true}
        onClose={jest.fn()}
        onStartWorkout={onStartWorkout}
        onLogFood={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('quick-action-start-workout'));

    expect(onStartWorkout).toHaveBeenCalled();
  });

  it('calls onLogFood when Log Food is pressed', () => {
    const onLogFood = jest.fn();
    render(
      <QuickActionMenu
        visible={true}
        onClose={jest.fn()}
        onStartWorkout={jest.fn()}
        onLogFood={onLogFood}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('quick-action-log-food'));

    expect(onLogFood).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn();
    render(
      <QuickActionMenu
        visible={true}
        onClose={onClose}
        onStartWorkout={jest.fn()}
        onLogFood={jest.fn()}
        accentColor="#2F80FF"
      />,
    );

    fireEvent.press(screen.getByTestId('quick-action-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });
});
