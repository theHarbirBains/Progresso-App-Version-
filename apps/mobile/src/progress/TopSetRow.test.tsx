import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AppCard } from '../design/AppCard';
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

describe('TopSetRow -- a plain, named row', () => {
  const props = {
    exerciseName: 'Bench Press',
    muscleGroupLabel: 'Chest',
    weightDisplay: 225,
    reps: 8,
    unit: 'lb' as const,
    accentColor: '#2F80FF',
    testID: 'row',
  };

  it('is not a card, and is a named button when pressable', () => {
    render(<TopSetRow {...props} onPress={jest.fn()} />);

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    const row = screen.getByTestId('row');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toBe('Bench Press, Chest, top set 225lb times 8');
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('is not announced as a button when it has nothing to open', () => {
    render(<TopSetRow {...props} />);

    expect(screen.getByTestId('row').props.accessibilityRole).toBeUndefined();
  });
});
