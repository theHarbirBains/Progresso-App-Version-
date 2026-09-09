import { fireEvent, render, screen } from '@testing-library/react-native';
import { TopSetRow } from './TopSetRow';

describe('TopSetRow', () => {
  it('shows the exercise name, weight x reps, and date', () => {
    render(
      <TopSetRow
        exerciseName="Bench Press"
        weightDisplay={225}
        reps={5}
        unit="lb"
        performedAt="2026-10-03T12:00:00Z"
        accentColor="#2F80FF"
        testID="row"
      />,
    );

    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByTestId('row')).toHaveTextContent(/225lb.*5/);
    expect(screen.getByTestId('row')).toHaveTextContent(/Oct 3/);
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <TopSetRow
        exerciseName="Bench Press"
        weightDisplay={225}
        reps={5}
        unit="lb"
        performedAt="2026-10-03T12:00:00Z"
        accentColor="#2F80FF"
        onPress={onPress}
        testID="row"
      />,
    );

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalled();
  });
});
