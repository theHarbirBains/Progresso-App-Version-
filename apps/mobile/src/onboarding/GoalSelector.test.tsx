import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoalSelector } from './GoalSelector';

describe('GoalSelector', () => {
  it('renders every fitness goal option', () => {
    render(<GoalSelector testID="goal" value={null} onChange={jest.fn()} />);

    expect(screen.getByTestId('goal-build_muscle')).toBeTruthy();
    expect(screen.getByTestId('goal-other')).toBeTruthy();
  });

  it('marks the selected value', () => {
    render(<GoalSelector testID="goal" value="lose_fat" onChange={jest.fn()} />);

    expect(screen.getByTestId('goal-lose_fat').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('goal-build_muscle').props.accessibilityState.selected).toBe(false);
  });

  it('calls onChange with the pressed goal', () => {
    const onChange = jest.fn();
    render(<GoalSelector testID="goal" value={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('goal-get_stronger'));

    expect(onChange).toHaveBeenCalledWith('get_stronger');
  });
});
