import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExerciseProgressRow } from './ExerciseProgressRow';

describe('ExerciseProgressRow', () => {
  it('shows the exercise name and current weight', () => {
    render(
      <ExerciseProgressRow
        exerciseName="Bench Press"
        currentWeightDisplay={225}
        unit="lb"
        deltaDisplay={40}
        percent={21.6}
        accentColor="#2F80FF"
        onPress={jest.fn()}
        testID="row"
      />,
    );

    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('225lb')).toBeTruthy();
  });

  it('shows an upward change with a plus sign and up arrow', () => {
    render(
      <ExerciseProgressRow
        exerciseName="Bench Press"
        currentWeightDisplay={225}
        unit="lb"
        deltaDisplay={40}
        percent={21.6}
        accentColor="#2F80FF"
        onPress={jest.fn()}
        testID="row"
      />,
    );

    expect(screen.getByText('+40lb · ↑ 21.6%')).toBeTruthy();
  });

  it('shows a downward change with a down arrow and no plus sign', () => {
    render(
      <ExerciseProgressRow
        exerciseName="Bench Press"
        currentWeightDisplay={185}
        unit="lb"
        deltaDisplay={-10}
        percent={-5.1}
        accentColor="#2F80FF"
        onPress={jest.fn()}
        testID="row"
      />,
    );

    expect(screen.getByText('-10lb · ↓ 5.1%')).toBeTruthy();
  });

  it('shows "Not enough data yet" when there is only one data point', () => {
    render(
      <ExerciseProgressRow
        exerciseName="Bench Press"
        currentWeightDisplay={225}
        unit="lb"
        deltaDisplay={null}
        percent={null}
        accentColor="#2F80FF"
        onPress={jest.fn()}
        testID="row"
      />,
    );

    expect(screen.getByText('Not enough data yet')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <ExerciseProgressRow
        exerciseName="Bench Press"
        currentWeightDisplay={225}
        unit="lb"
        deltaDisplay={40}
        percent={21.6}
        accentColor="#2F80FF"
        onPress={onPress}
        testID="row"
      />,
    );

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalled();
  });
});
