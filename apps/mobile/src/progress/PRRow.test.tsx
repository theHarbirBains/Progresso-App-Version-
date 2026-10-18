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

  it("shows the exercise's photo in place of the ribbon, opening it full-screen when tapped", () => {
    const onPress = jest.fn();
    render(
      <PRRow
        exerciseName="Leg Press"
        photoUrl="https://example.com/leg-press.jpg"
        weightDisplay={450}
        reps={7}
        unit="lb"
        achievedAt="2026-10-03T00:00:00Z"
        recordType="7-Rep PR"
        accentColor="#D99A50"
        onPress={onPress}
        testID="row"
      />,
    );

    expect(screen.queryByTestId('row-ribbon')).toBeNull();
    fireEvent.press(screen.getByTestId('row-photo-zoom'));

    // The machine, full-screen -- without also opening the exercise.
    expect(screen.getByTestId('row-photo-lightbox')).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps the ribbon when the exercise has no photo', () => {
    render(
      <PRRow
        exerciseName="Bench Press"
        photoUrl={null}
        weightDisplay={225}
        reps={5}
        unit="lb"
        achievedAt="2026-10-03T00:00:00Z"
        recordType="5-Rep PR"
        accentColor="#D99A50"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row-ribbon')).toBeTruthy();
    expect(screen.queryByTestId('row-photo')).toBeNull();
  });
});

describe('PRRow for a bodyweight or timed record', () => {
  it('shows the given value in place of a weight', () => {
    render(
      <PRRow
        exerciseName="Plank"
        weightDisplay={0}
        reps={null}
        unit="lb"
        value="1:30"
        achievedAt="2026-10-03T00:00:00Z"
        recordType="Longest"
        accentColor="#D99A50"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row')).toHaveTextContent(/Longest/);
    expect(screen.getByTestId('row')).toHaveTextContent(/1:30/);
    expect(screen.getByTestId('row')).not.toHaveTextContent(/lb/);
  });
});
