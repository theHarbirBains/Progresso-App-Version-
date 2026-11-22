import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoalSelector } from './GoalSelector';

describe('GoalSelector', () => {
  it('offers the six goals, and nothing else', () => {
    render(<GoalSelector testID="goal" value={[]} onChange={jest.fn()} max={3} />);

    for (const [value, label] of [
      ['build_muscle', 'Build Muscle'],
      ['get_stronger', 'Get Stronger'],
      ['lose_fat', 'Lose Fat'],
      ['improve_athletic_performance', 'Improve Athletic Performance'],
      ['improve_fitness', 'Improve Overall Fitness'],
      ['maintain_fitness', 'Maintain Fitness'],
    ]) {
      expect(screen.getByTestId(`goal-${value}`)).toHaveTextContent(new RegExp(label!));
    }
    expect(screen.queryByTestId('goal-general_health')).toBeNull();
    expect(screen.queryByTestId('goal-other')).toBeNull();
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
        value={['lose_fat', 'get_stronger', 'maintain_fitness']}
        onChange={onChange}
        max={3}
      />,
    );

    expect(screen.getByTestId('goal-build_muscle').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('goal-build_muscle'));
    expect(onChange).not.toHaveBeenCalled();

    expect(
      screen.getByTestId('goal-maintain_fitness').props.accessibilityState.disabled,
    ).toBeFalsy();
  });
});
