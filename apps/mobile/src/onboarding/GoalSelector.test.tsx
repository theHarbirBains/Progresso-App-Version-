import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoalSelector } from './GoalSelector';

describe('GoalSelector', () => {
  it('renders every fitness goal option', () => {
    render(<GoalSelector testID="goal" value={[]} onChange={jest.fn()} max={3} />);

    expect(screen.getByTestId('goal-build_muscle')).toBeTruthy();
    expect(screen.getByTestId('goal-other')).toBeTruthy();
  });

  it('marks every picked goal', () => {
    render(
      <GoalSelector
        testID="goal"
        value={['lose_fat', 'get_stronger']}
        onChange={jest.fn()}
        max={3}
      />,
    );

    expect(screen.getByTestId('goal-lose_fat').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('goal-get_stronger').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('goal-build_muscle').props.accessibilityState.selected).toBe(false);
  });

  it('adds a tapped goal after the others, and drops a picked one when tapped again', () => {
    const onChange = jest.fn();
    render(<GoalSelector testID="goal" value={['lose_fat']} onChange={onChange} max={3} />);

    fireEvent.press(screen.getByTestId('goal-get_stronger'));
    expect(onChange).toHaveBeenLastCalledWith(['lose_fat', 'get_stronger']);

    fireEvent.press(screen.getByTestId('goal-lose_fat'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('dims the rest once the most are picked, leaving the picked ones to change', () => {
    const onChange = jest.fn();
    render(
      <GoalSelector
        testID="goal"
        value={['lose_fat', 'get_stronger', 'other']}
        onChange={onChange}
        max={3}
      />,
    );

    expect(screen.getByTestId('goal-build_muscle').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('goal-build_muscle'));
    expect(onChange).not.toHaveBeenCalled();

    expect(screen.getByTestId('goal-other').props.accessibilityState.disabled).toBe(false);
  });
});
