import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { colors, radii } from '../design/theme';
import { DashboardStat } from './DashboardStat';

describe('DashboardStat', () => {
  it('renders the value, title, and subtitle', () => {
    render(<DashboardStat testID="stat-sets" value="482" title="Sets Done" subtitle="All Time" />);

    expect(screen.getByTestId('stat-sets')).toHaveTextContent(/482/);
    expect(screen.getByTestId('stat-sets')).toHaveTextContent(/Sets Done/);
    expect(screen.getByTestId('stat-sets')).toHaveTextContent(/All Time/);
  });

  it('is announced as one button naming its whole content, and calls onPress, when tappable', () => {
    const onPress = jest.fn();
    render(
      <DashboardStat
        testID="stat-sets"
        value="482"
        title="Sets Done"
        subtitle="All Time"
        onPress={onPress}
      />,
    );

    const cell = screen.getByTestId('stat-sets');
    expect(cell.props.accessibilityRole).toBe('button');
    expect(cell.props.accessibilityLabel).toBe('Sets Done, 482, All Time');

    fireEvent.press(cell);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a plain, non-interactive cell when no onPress is given', () => {
    render(<DashboardStat testID="stat-steps" value="--" title="Steps" subtitle="Not connected" />);

    expect(screen.getByTestId('stat-steps').props.accessibilityRole).not.toBe('button');
  });

  it('shows the number in neutral text by default, and in a given accent only when asked', () => {
    const { rerender } = render(
      <DashboardStat testID="stat" value="3/4" title="Weekly Goal" subtitle="This Week" />,
    );
    const valueStyle = () => StyleSheet.flatten(screen.getByText('3/4').props.style);
    expect(valueStyle().color).toBe(colors.textPrimary);

    rerender(
      <DashboardStat
        testID="stat"
        value="3/4"
        title="Weekly Goal"
        subtitle="This Week"
        valueColor="#2F80FF"
      />,
    );
    expect(valueStyle().color).toBe('#2F80FF');
  });

  it('renders the number in the mono readout face', () => {
    render(<DashboardStat testID="stat" value="482" title="Sets Done" subtitle="All Time" />);

    expect(String(StyleSheet.flatten(screen.getByText('482').props.style).fontFamily)).toMatch(
      /^JetBrainsMono/,
    );
  });
});

describe('DashboardStat text values', () => {
  it('sets a word or name in the regular UI face on a single truncating line', () => {
    render(
      <DashboardStat
        testID="stat-last"
        valueKind="text"
        value="Upper Body Hypertrophy"
        title="Last Workout"
        subtitle="Fri, Sep 18"
      />,
    );

    const value = screen.getByText('Upper Body Hypertrophy');
    expect(String(StyleSheet.flatten(value.props.style).fontFamily)).toMatch(/^Manrope_/);
    expect(value.props.numberOfLines).toBe(1);
  });

  it('keeps the mono numeric face for figures, on as many lines as it needs', () => {
    render(<DashboardStat testID="stat" value="482" title="Sets Done" subtitle="All Time" />);

    const value = screen.getByText('482');
    expect(String(StyleSheet.flatten(value.props.style).fontFamily)).toMatch(/^JetBrainsMono/);
    expect(value.props.numberOfLines).toBeUndefined();
  });

  it('is a raised block with the control radius and no border of its own', () => {
    render(<DashboardStat testID="stat" value="1" title="Workouts" subtitle="This Month" />);

    const style = StyleSheet.flatten(screen.getByTestId('stat').props.style);
    expect(style.backgroundColor).toBe(colors.surfaceRaised);
    expect(style.borderRadius).toBe(radii.md);
    expect(style.borderWidth).toBeUndefined();
  });
});
