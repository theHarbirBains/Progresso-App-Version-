import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { WeeklyCalorieBudget } from './WeeklyCalorieBudget';

function renderBudget(props: Partial<Parameters<typeof WeeklyCalorieBudget>[0]> = {}) {
  const onSetTarget = jest.fn();
  render(
    <WeeklyCalorieBudget
      consumed={9450}
      dailyTarget={2000}
      daysLeft={5}
      accentColor="#E8A33D"
      onSetTarget={onSetTarget}
      {...props}
    />,
  );
  return { onSetTarget };
}

describe('WeeklyCalorieBudget', () => {
  it("shows the week's calories against 7 times the daily target, and what's left over the days to go", () => {
    renderBudget();

    expect(screen.getByTestId('weekly-budget-consumed')).toHaveTextContent('9,450');
    expect(screen.getByTestId('weekly-budget-target')).toHaveTextContent('/ 14,000 cal');
    expect(screen.getByTestId('weekly-budget-remaining')).toHaveTextContent(
      '4,550 cal left · 5 days to go, today included',
    );
    expect(StyleSheet.flatten(screen.getByTestId('weekly-budget-bar').props.style).width).toBe(
      '67.5%',
    );
  });

  it('says plainly how far over the budget the week is, with the bar full', () => {
    renderBudget({ consumed: 14350, daysLeft: 1 });

    expect(screen.getByTestId('weekly-budget-remaining')).toHaveTextContent(
      "350 cal over this week's budget",
    );
    const bar = StyleSheet.flatten(screen.getByTestId('weekly-budget-bar').props.style);
    expect(bar.width).toBe('100%');
    expect(bar.backgroundColor).toBe('#E8A33D');
  });

  it('names another week, and counts from the day shown rather than today', () => {
    renderBudget({ title: 'Week of October 11', today: false, consumed: 9450, daysLeft: 3 });

    expect(screen.getByText('Week of October 11')).toBeTruthy();
    expect(screen.getByTestId('weekly-budget-remaining')).toHaveTextContent(
      '4,550 cal left · 3 days to go, this day included',
    );
    expect(screen.getByLabelText(/Week of October 11, 9,450 of 14,000 calories/)).toBeTruthy();
  });

  it("says another week's over plainly too", () => {
    renderBudget({ title: 'Week of October 11', today: false, consumed: 14350, daysLeft: 1 });

    expect(screen.getByTestId('weekly-budget-remaining')).toHaveTextContent(
      "350 cal over the week's budget",
    );
  });

  it('counts one day as a day', () => {
    renderBudget({ consumed: 12000, daysLeft: 1 });

    expect(screen.getByTestId('weekly-budget-remaining')).toHaveTextContent(
      '2,000 cal left · 1 day to go, today included',
    );
  });

  it('shows no figure while the earlier days are read', () => {
    renderBudget({ consumed: null });

    expect(screen.getByTestId('weekly-budget-consumed')).toHaveTextContent('—');
    expect(screen.queryByTestId('weekly-budget-remaining')).toBeNull();
  });

  it('offers to set a target, never a made-up budget, when there is no daily target', () => {
    const { onSetTarget } = renderBudget({ dailyTarget: null });

    expect(screen.getByTestId('weekly-budget-no-target')).toHaveTextContent(
      'Set a daily calorie target to get a weekly budget.',
    );
    expect(screen.queryByTestId('weekly-budget-bar')).toBeNull();
    fireEvent.press(screen.getByTestId('weekly-budget-set-target'));
    expect(onSetTarget).toHaveBeenCalled();
  });

  it("says when the week's total couldn't be read", () => {
    renderBudget({ failed: true });

    expect(screen.getByTestId('weekly-budget-error')).toHaveTextContent(
      "This week's total couldn't be loaded.",
    );
  });

  it('reads as one figure to assistive tech, and renders no bare text', () => {
    renderBudget();

    expect(screen.getByLabelText(/This Week, 9,450 of 14,000 calories/)).toBeTruthy();
    expectNoBareText();
  });
});
