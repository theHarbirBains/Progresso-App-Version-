import { fireEvent, render, screen } from '@testing-library/react-native';
import { StrengthProgressRow } from './StrengthProgressRow';

describe('StrengthProgressRow', () => {
  it('shows the exercise name, muscle group, delta, and progress level', () => {
    render(
      <StrengthProgressRow
        testID="row"
        exerciseName="Squat"
        muscleGroupLabel="Legs"
        deltaDisplay={55}
        unit="lb"
        level="significant"
        accentColor="#2F80FF"
        onPress={jest.fn()}
      />,
    );

    const row = screen.getByTestId('row');
    expect(row).toHaveTextContent(/Squat/);
    expect(row).toHaveTextContent(/Legs/);
    expect(row).toHaveTextContent(/\+55lb/);
    expect(row).toHaveTextContent(/Significant Progress/);
  });

  it('shows "Progressing" for a non-significant level', () => {
    render(
      <StrengthProgressRow
        testID="row"
        exerciseName="Bicep Curl"
        muscleGroupLabel="Arms"
        deltaDisplay={10}
        unit="lb"
        level="progressing"
        accentColor="#2F80FF"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId('row')).toHaveTextContent(/Progressing/);
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <StrengthProgressRow
        testID="row"
        exerciseName="Deadlift"
        muscleGroupLabel="Back"
        deltaDisplay={70}
        unit="lb"
        level="significant"
        accentColor="#2F80FF"
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalled();
  });
});
