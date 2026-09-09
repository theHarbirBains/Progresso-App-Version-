import { fireEvent, render, screen } from '@testing-library/react-native';
import { PRRow } from './PRRow';

describe('PRRow', () => {
  it('shows a rep-count PR with its record type and reps', () => {
    render(
      <PRRow
        exerciseName="Bench Press"
        weightDisplay={225}
        reps={5}
        unit="lb"
        achievedAt="2026-10-03T00:00:00Z"
        recordType="5-Rep PR"
        accentColor="#2F80FF"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row')).toHaveTextContent(/5-Rep PR/);
    expect(screen.getByTestId('row')).toHaveTextContent(/225lb.*5/);
  });

  it('shows a true 1RM record without a rep count in the value', () => {
    render(
      <PRRow
        exerciseName="Deadlift"
        weightDisplay={405}
        reps={null}
        unit="lb"
        achievedAt="2026-09-27T00:00:00Z"
        recordType="1RM"
        accentColor="#2F80FF"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row')).toHaveTextContent(/1RM/);
    expect(screen.getByTestId('row')).not.toHaveTextContent(/×/);
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <PRRow
        exerciseName="Bench Press"
        weightDisplay={225}
        reps={5}
        unit="lb"
        achievedAt="2026-10-03T00:00:00Z"
        recordType="5-Rep PR"
        accentColor="#2F80FF"
        onPress={onPress}
        testID="row"
      />,
    );

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalled();
  });
});
