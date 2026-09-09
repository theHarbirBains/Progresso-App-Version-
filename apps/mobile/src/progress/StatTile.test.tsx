import { render, screen } from '@testing-library/react-native';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders the value and label', () => {
    render(
      <StatTile
        testID="stat-workouts"
        icon="activity"
        label="Workouts"
        value="47"
        accentColor="#29E3C7"
      />,
    );

    expect(screen.getByTestId('stat-workouts')).toBeTruthy();
    expect(screen.getByText('47')).toBeTruthy();
    expect(screen.getByText('Workouts')).toBeTruthy();
  });
});
