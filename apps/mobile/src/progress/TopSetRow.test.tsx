import { fireEvent, render, screen } from '@testing-library/react-native';
import { TopSetRow } from './TopSetRow';

describe('TopSetRow', () => {
  it('shows the exercise name, muscle group, weight x reps, and the "Top Set" label', () => {
    render(
      <TopSetRow
        exerciseName="Bench Press"
        muscleGroupLabel="Chest"
        weightDisplay={225}
        reps={8}
        unit="lb"
        accentColor="#2F80FF"
        testID="row"
      />,
    );

    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('Chest')).toBeTruthy();
    expect(screen.getByTestId('row')).toHaveTextContent(/225lb.*8/);
    expect(screen.getByText('Top Set')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <TopSetRow
        exerciseName="Bench Press"
        muscleGroupLabel="Chest"
        weightDisplay={225}
        reps={8}
        unit="lb"
        accentColor="#2F80FF"
        onPress={onPress}
        testID="row"
      />,
    );

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalled();
  });
});
