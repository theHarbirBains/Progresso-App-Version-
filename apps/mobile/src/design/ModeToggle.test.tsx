import { fireEvent, render, screen } from '@testing-library/react-native';
import { ModeToggle } from './ModeToggle';

const workoutTheme = { accent: '#2F80FF', onAccent: '#FFFFFF' };
const nutritionTheme = { accent: '#29E3C7', onAccent: '#06201C' };

describe('ModeToggle', () => {
  it('renders both segments with the given testID prefix', () => {
    render(
      <ModeToggle
        mode="workout"
        onChange={jest.fn()}
        workoutTheme={workoutTheme}
        nutritionTheme={nutritionTheme}
        testIDPrefix="dashboard"
      />,
    );

    expect(screen.getByTestId('dashboard-mode-workout')).toBeTruthy();
    expect(screen.getByTestId('dashboard-mode-nutrition')).toBeTruthy();
    expect(screen.getByText('Workout')).toBeTruthy();
    expect(screen.getByText('Nutrition')).toBeTruthy();
  });

  it('calls onChange("nutrition") when the Nutrition segment is pressed', () => {
    const onChange = jest.fn();
    render(
      <ModeToggle
        mode="workout"
        onChange={onChange}
        workoutTheme={workoutTheme}
        nutritionTheme={nutritionTheme}
        testIDPrefix="profile"
      />,
    );

    fireEvent.press(screen.getByTestId('profile-mode-nutrition'));

    expect(onChange).toHaveBeenCalledWith('nutrition');
  });

  it('calls onChange("workout") when the Workout segment is pressed', () => {
    const onChange = jest.fn();
    render(
      <ModeToggle
        mode="nutrition"
        onChange={onChange}
        workoutTheme={workoutTheme}
        nutritionTheme={nutritionTheme}
        testIDPrefix="progress"
      />,
    );

    fireEvent.press(screen.getByTestId('progress-mode-workout'));

    expect(onChange).toHaveBeenCalledWith('workout');
  });

  it('uses a distinct testID prefix per screen, so multiple instances never collide', () => {
    render(
      <ModeToggle
        mode="workout"
        onChange={jest.fn()}
        workoutTheme={workoutTheme}
        nutritionTheme={nutritionTheme}
        testIDPrefix="food-library"
      />,
    );

    expect(screen.getByTestId('food-library-mode-workout')).toBeTruthy();
    expect(screen.getByTestId('food-library-mode-nutrition')).toBeTruthy();
  });
});
