import { fireEvent, render, screen } from '@testing-library/react-native';
import { DashboardStatCard } from './DashboardStatCard';

describe('DashboardStatCard', () => {
  it('renders the value, title, and subtitle', () => {
    render(
      <DashboardStatCard
        testID="stat-sets"
        icon="check-circle"
        value="482"
        title="Sets Done"
        subtitle="All Time"
        accentColor="#2F80FF"
      />,
    );

    expect(screen.getByTestId('stat-sets')).toHaveTextContent(/482/);
    expect(screen.getByTestId('stat-sets')).toHaveTextContent(/Sets Done/);
    expect(screen.getByTestId('stat-sets')).toHaveTextContent(/All Time/);
  });

  it('calls onPress when tapped, if provided', () => {
    const onPress = jest.fn();
    render(
      <DashboardStatCard
        testID="stat-sets"
        icon="check-circle"
        value="482"
        title="Sets Done"
        subtitle="All Time"
        accentColor="#2F80FF"
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('stat-sets'));

    expect(onPress).toHaveBeenCalled();
  });

  it('renders as non-interactive when no onPress is given', () => {
    render(
      <DashboardStatCard
        testID="stat-streak"
        icon="zap"
        value="5"
        title="Day Streak"
        subtitle="Keep Going"
        accentColor="#2F80FF"
      />,
    );

    expect(screen.getByTestId('stat-streak').props.accessibilityRole).not.toBe('button');
  });
});
